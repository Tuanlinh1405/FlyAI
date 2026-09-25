import json
import math
import sys
from datetime import datetime, timedelta

import numpy as np

try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False


def is_mega_sale(value):
    return value.day == value.month


def build_feature(value, trend, lags):
    hour = value.hour
    weekday = (value.weekday() + 1) % 7
    return [
        1.0,
        trend,
        math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24),
        math.sin(2 * math.pi * weekday / 7),
        math.cos(2 * math.pi * weekday / 7),
        1.0 if weekday in (0, 6) else 0.0,
        1.0 if is_mega_sale(value) else 0.0,
        *lags,
    ]


class RidgeModel:
    def __init__(self, alpha=8.0):
        self.alpha = alpha

    def fit(self, x, y):
        self.center = x.mean(axis=0)
        self.scale = x.std(axis=0)
        self.center[0], self.scale[0] = 0.0, 1.0
        self.scale[self.scale == 0] = 1.0
        normalized = (x - self.center) / self.scale
        penalty = np.eye(x.shape[1]) * self.alpha
        penalty[0, 0] = 0.0
        self.coef = np.linalg.solve(normalized.T @ normalized + penalty, normalized.T @ y)
        return self

    def predict(self, x):
        return ((x - self.center) / self.scale) @ self.coef


def create_xgboost():
    return XGBRegressor(
        objective="reg:squarederror",
        n_estimators=180,
        max_depth=3,
        learning_rate=0.04,
        min_child_weight=5,
        subsample=0.85,
        colsample_bytree=0.9,
        reg_lambda=10.0,
        reg_alpha=0.1,
        n_jobs=1,
        random_state=42,
        verbosity=0,
    )


def score(actual, predicted):
    predicted = np.clip(np.asarray(predicted, dtype=float), 0, None)
    actual = np.asarray(actual, dtype=float)
    error = actual - predicted
    denominator = np.maximum((np.abs(actual) + np.abs(predicted)) / 2, 1)
    return {
        "mae": float(np.mean(np.abs(error))),
        "rmse": float(np.sqrt(np.mean(error ** 2))),
        "smape": float(np.mean(np.abs(error) / denominator) * 100),
    }


def train_and_predict(payload):
    orders = sorted(datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None) for value in payload["orders"])
    if len(orders) < 30:
        raise ValueError("Cần tối thiểu 30 đơn hàng hợp lệ để huấn luyện mô hình.")
    start = orders[0].replace(minute=0, second=0, microsecond=0)
    end = orders[-1].replace(minute=0, second=0, microsecond=0)
    length = int((end - start).total_seconds() // 3600) + 1
    series = np.zeros(length, dtype=float)
    for order in orders:
        series[int((order - start).total_seconds() // 3600)] += 1

    rows, target = [], []
    for index in range(168, len(series)):
        value = start + timedelta(hours=index)
        lags = [series[index - 1], series[index - 24], series[index - 168], series[index - 24:index].mean(), series[index - 168:index].mean()]
        rows.append(build_feature(value, index / max(len(series) - 1, 1), lags))
        target.append(series[index])
    x, y = np.asarray(rows, dtype=float), np.asarray(target, dtype=float)
    if len(x) < 72:
        raise ValueError("Dữ liệu cần phủ ít nhất 10 ngày để tạo đặc trưng lag theo tuần.")

    model_factories = {"Ridge Regression": lambda: RidgeModel(8.0)}
    if XGBOOST_AVAILABLE:
        model_factories["XGBoost"] = create_xgboost
    initial = int(len(x) * 0.55)
    horizon = max(48, (len(x) - initial) // 3)
    fold_predictions = {name: [] for name in model_factories}
    fold_actual = []
    naive_predictions = []
    folds = 0
    for fold in range(3):
        train_end = initial + fold * horizon
        validation_end = len(x) if fold == 2 else min(len(x), train_end + horizon)
        if train_end >= len(x) or validation_end <= train_end:
            continue
        validation_indices = np.arange(train_end, validation_end)
        actual = y[validation_indices]
        fold_actual.extend(actual.tolist())
        naive_predictions.extend([y[index - 168] if index >= 168 else y[max(0, index - 24)] for index in validation_indices])
        for name, factory in model_factories.items():
            fitted = factory().fit(x[:train_end], y[:train_end])
            fold_predictions[name].extend(np.clip(fitted.predict(x[validation_indices]), 0, None).tolist())
        folds += 1

    candidates = []
    for name, predictions in fold_predictions.items():
        values = score(fold_actual, predictions)
        candidates.append({"name": name, **{key: round(value, 3 if key != "smape" else 1) for key, value in values.items()}})
    candidates.sort(key=lambda item: item["mae"])
    selected_name = candidates[0]["name"]
    selected = model_factories[selected_name]().fit(x, y)

    by_hour = np.asarray([series[[index for index in range(len(series)) if (start + timedelta(hours=index)).hour == hour]].mean() for hour in range(24)])
    by_dow_hour = np.zeros((7, 24), dtype=float)
    for weekday in range(7):
        for hour in range(24):
            values = [series[index] for index in range(len(series)) if ((start + timedelta(hours=index)).weekday() + 1) % 7 == weekday and (start + timedelta(hours=index)).hour == hour]
            by_dow_hour[weekday, hour] = np.mean(values) if values else by_hour[hour]
    recent24, recent168, last = series[-24:].mean(), series[-168:].mean(), series[-1]
    forecast_date = datetime.fromisoformat(payload["forecastDate"])
    future_features = []
    for hour in range(24):
        value = forecast_date.replace(hour=hour)
        weekday = (value.weekday() + 1) % 7
        lags = [last, by_hour[hour], by_dow_hour[weekday, hour], recent24, recent168]
        future_features.append(build_feature(value, 1.0, lags))
    hourly = np.clip(selected.predict(np.asarray(future_features, dtype=float)), 0.01, None)
    slot_values = np.asarray([hourly[8 + index * 2:10 + index * 2].sum() for index in range(8)])
    slot_weights = slot_values / max(slot_values.sum(), 1)

    daily = {}
    for order in orders:
        daily.setdefault(order.date().isoformat(), 0)
        daily[order.date().isoformat()] += 1
    mega = [count for key, count in daily.items() if is_mega_sale(datetime.fromisoformat(key))]
    regular = [count for key, count in daily.items() if not is_mega_sale(datetime.fromisoformat(key))]
    raw_uplift = (np.mean(mega) if mega else 1) / max(np.mean(regular) if regular else 1, 1)
    uplift = min(2.5, max(0.8, 1 + (raw_uplift - 1) * len(mega) / (len(mega) + 5)))
    naive_score = score(fold_actual, naive_predictions)
    selected_metrics = next(item for item in candidates if item["name"] == selected_name)
    return {
        "modelName": f"{selected_name} chuỗi thời gian",
        "selectedModel": selected_name,
        "selectionReason": f"MAE walk-forward thấp nhất trong {folds} folds",
        "target": "Số đơn theo giờ",
        "trainingPoints": len(x),
        "trainingOrders": len(orders),
        "validation": {**{key: selected_metrics[key] for key in ("mae", "rmse", "smape")}, "seasonalNaiveMae": round(naive_score["mae"], 3), "folds": folds},
        "candidates": candidates,
        "features": ["Giờ", "Thứ trong tuần", "Cuối tuần", "Mega Sale", "Lag 1h", "Lag 24h", "Lag 168h", "TB trượt 24h", "TB trượt 168h"],
        "megaSale": {"isMegaSale": is_mega_sale(forecast_date), "historicDays": len(mega), "observedUplift": round(float(uplift), 3), "observedChangePercent": round(float((uplift - 1) * 100), 1), "rule": "Ngày có số ngày trùng số tháng: 6/6, 7/7, 8/8, …"},
        "forecastDate": payload["forecastDate"],
        "predictedDailyBaseline": round(float(hourly.sum()), 1),
        "hourlyWeights": [round(float(value), 6) for value in hourly],
        "slotWeights": [round(float(value), 6) for value in slot_weights],
        "xgboostAvailable": XGBOOST_AVAILABLE,
    }


if __name__ == "__main__":
    try:
        print(json.dumps(train_and_predict(json.load(sys.stdin)), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(1)
