import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_ANALYSIS, deriveScenario, detectColumns } from '../src/dataEngine.js'

const assumptions = {
  campaignType: 'Mega Sale', traffic: 30000, conversion: 4.5, discount: 30, voucher: 500,
  freeship: true, banner: true, flashSale: true, startTime: '20:00', cutoffTime: '23:30',
  itemsPerOrder: 2.15, efficiency: 85, backlog: 350, staging: 1000, availableToPromise: 5000,
  bags: 1500, cartons: 500, tape: 80, labels: 1500, cartonRate: 35, ordersPerTape: 25,
  confirmStaff: 3, confirmRate: 90, printStaff: 3, printRate: 75, pickingStaff: 6, pickingRate: 50,
  packingStaff: 6, packingRate: 40, handoffStaff: 2, handoffRate: 80,
}

test('scenario reconciles forecast across time slots', () => {
  const scenario = deriveScenario(DEFAULT_ANALYSIS, assumptions)
  assert.equal(scenario.forecastOrders, 1350)
  assert.equal(scenario.slots.reduce((sum, slot) => sum + slot.orders, 0), scenario.forecastOrders)
  assert.equal(scenario.staffBySlot.reduce((sum, slot) => sum + slot.backlog, 0), assumptions.backlog)
  assert.ok(scenario.interval.low <= scenario.forecastOrders)
  assert.ok(scenario.interval.high >= scenario.forecastOrders)
})

test('ML baseline participates in hybrid demand forecast', () => {
  const data = { ...DEFAULT_ANALYSIS, ml: { predictedDailyBaseline: 16, validation: { mae: .657 }, megaSale: { observedUplift: .935 }, slotWeights: Array(8).fill(.125) } }
  const scenario = deriveScenario(data, assumptions)
  assert.ok(scenario.forecastOrders < scenario.funnelOrders)
  assert.ok(scenario.forecastOrders > scenario.modelScenario)
  assert.equal(scenario.slots.reduce((sum, slot) => sum + slot.orders, 0), scenario.forecastOrders)
})

test('capacity and materials expose shortages without negative recommendations', () => {
  const constrained = { ...assumptions, handoffStaff: 1, bags: 0, labels: 0 }
  const scenario = deriveScenario(DEFAULT_ANALYSIS, constrained)
  assert.equal(scenario.bottleneck.name, 'Bàn giao')
  assert.ok(scenario.delayedOrders > 0)
  assert.ok(scenario.extraStaff > 0)
  assert.equal(scenario.materials.find(item => item.key === 'bags').status, 'Thiếu hàng')
  assert.ok(scenario.staffBySlot.every(item => item.recommended >= item.current && item.extra >= 0))
})

test('revenue column accepts both Thành Tiền and Tổng Tiền Hàng', () => {
  assert.equal(detectColumns(['Mã Đơn Hàng', 'Thành Tiền']).revenue, 'Thành Tiền')
  assert.equal(detectColumns(['Mã Đơn Hàng', 'Tổng Tiền Hàng']).revenue, 'Tổng Tiền Hàng')
})
