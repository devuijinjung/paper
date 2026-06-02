# TradingView Paper Trading

TradingView 알림(Alert)이 보내는 웹훅을 수신해 **가상 자금으로만** 매매를 시뮬레이션하는 실시간 모의매매 웹앱.  
실제 주문은 절대 발생하지 않습니다.

---

## 프로젝트 구조

```
paper/
├── backend/
│   ├── main.py            # FastAPI 앱 진입점
│   ├── config.py          # 환경변수 설정
│   ├── database.py        # SQLAlchemy 비동기 DB 설정
│   ├── models.py          # ORM 모델 (trades, positions, …)
│   ├── schemas.py         # Pydantic 스키마
│   ├── trading_engine.py  # 모의매매 핵심 엔진
│   ├── price_feed.py      # Binance 공개 API 시세 폴링
│   ├── ws_manager.py      # WebSocket 브로드캐스트 관리
│   ├── routers/
│   │   ├── webhook.py     # POST /webhook
│   │   ├── api.py         # GET /api/*, POST /api/reset
│   │   └── ws.py          # WS /ws
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── useWebSocket.js
│   │   └── components/
│   │       ├── Summary.jsx
│   │       ├── Positions.jsx
│   │       ├── Trades.jsx
│   │       ├── EquityCurve.jsx
│   │       ├── AlertLogs.jsx
│   │       └── Settings.jsx
│   ├── package.json
│   └── vite.config.js     # /api, /ws 를 localhost:8000 으로 프록시
└── tests/
    └── test_trading_engine.py
```

---

## 1. 설치 및 실행

### 사전 요구사항

- Python 3.11+
- Node.js 18+

### 백엔드

```bash
cd backend
cp .env.example .env          # 필요 시 값 수정
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

> Vite의 프록시 설정 덕분에 `/api`, `/webhook`, `/ws` 요청이 자동으로 백엔드로 전달됩니다.

---

## 2. TradingView 알림 설정 방법

### 웹훅 URL

```
http://<서버IP>:8000/webhook
```

ngrok를 사용하는 경우 아래 섹션 참고.

### 메시지 JSON 형식

TradingView 알림 편집창 → **Message** 란에 다음 JSON을 입력합니다:

```json
{
  "secret": "MY_SECRET_TOKEN",
  "ticker": "{{ticker}}",
  "action": "buy",
  "price": {{close}},
  "order_size_pct": 20,
  "strategy": "MA_Cross",
  "time": "{{timenow}}"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `secret` | ✅ | `.env`의 `WEBHOOK_SECRET` 와 일치해야 함 |
| `ticker` | ✅ | 거래 심볼 (예: `BTCUSDT`) |
| `action` | ✅ | `buy` / `sell` / `close` |
| `price` | ❌ | 비우면 Binance 실시간 시세로 체결 |
| `order_size_pct` | ❌ | 현금 잔고 대비 진입 비중(%) |
| `quantity` | ❌ | 직접 수량 지정 (order_size_pct 와 택일) |
| `strategy` | ❌ | 전략 이름 (로그용) |

### Secret 설정

`.env` 파일의 `WEBHOOK_SECRET` 값을 TradingView 메시지 JSON의 `"secret"` 값과 동일하게 설정합니다.

---

## 3. ngrok로 로컬 테스트

로컬 PC에서 TradingView 웹훅을 받으려면 공개 URL이 필요합니다.

```bash
# ngrok 설치 후
ngrok http 8000
```

출력된 `https://xxxx.ngrok.io` 주소를 TradingView 웹훅 URL로 설정합니다:

```
https://xxxx.ngrok.io/webhook
```

---

## 4. curl로 /webhook 테스트

### BUY 신호

```bash
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "MY_SECRET_TOKEN",
    "ticker": "BTCUSDT",
    "action": "buy",
    "price": 50000,
    "order_size_pct": 20,
    "strategy": "MA_Cross"
  }'
```

### SELL 신호

```bash
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "MY_SECRET_TOKEN",
    "ticker": "BTCUSDT",
    "action": "sell",
    "strategy": "MA_Cross"
  }'
```

### CLOSE (전량 청산)

```bash
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "MY_SECRET_TOKEN",
    "ticker": "BTCUSDT",
    "action": "close"
  }'
```

### 계좌 초기화

```bash
curl -X POST http://localhost:8000/api/reset \
  -H "Content-Type: application/json" \
  -d '{"initial_capital": 10000}'
```

---

## 5. 단위 테스트 실행

```bash
# 프로젝트 루트에서
pip install -r backend/requirements.txt
pytest tests/ -v
```

---

## 환경변수 (.env)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `WEBHOOK_SECRET` | `MY_SECRET_TOKEN` | 웹훅 인증 토큰 |
| `INITIAL_CAPITAL` | `10000.0` | 초기 가상 자본 ($) |
| `FEE_RATE` | `0.001` | 수수료율 (0.1%) |
| `SLIPPAGE` | `0.0005` | 슬리피지 (0.05%) |
| `DATABASE_URL` | `sqlite+aiosqlite:///./paper_trading.db` | DB 연결 문자열 |

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/webhook` | TradingView 알림 수신 |
| GET | `/api/portfolio` | 포트폴리오 현황 |
| GET | `/api/trades` | 거래 내역 |
| GET | `/api/positions` | 보유 포지션 |
| GET | `/api/alerts` | 수신 알림 로그 |
| POST | `/api/reset` | 계좌 초기화 |
| WS | `/ws` | 실시간 업데이트 |
