# Chạy FLYING HIGH bằng Docker

## Chuẩn bị

1. Cài Docker Desktop hoặc Docker Engine kèm Docker Compose.
2. Sao chép `.env.example` thành `.env`.
3. Điền Gemini API key và model hợp lệ vào `.env`.
4. Không commit file `.env` lên Git.

## Khởi động

```powershell
docker compose up --build -d
```

Mặc định website chạy tại `http://localhost`. Có thể đổi cổng bằng `WEB_PORT` trong `.env`, ví dụ `WEB_PORT=8080` rồi truy cập `http://localhost:8080`.

## Kiểm tra

```powershell
docker compose ps
docker compose logs -f
```

Health check đi qua frontend:

```text
http://localhost/api/health
```

Nếu dùng cổng khác, thay `localhost` bằng `localhost:<WEB_PORT>`.

## Dừng hoặc cập nhật

```powershell
docker compose down
docker compose up --build -d
```

Frontend Nginx chuyển tiếp mọi request `/api/*` tới container backend. Backend chạy Node.js, gọi Python/XGBoost cho dự báo và gọi Gemini bằng các key được truyền qua biến môi trường.
