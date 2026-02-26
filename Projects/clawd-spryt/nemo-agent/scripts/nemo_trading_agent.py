"""
NEMO Trading Agent (paper trading by default).
Connects Kalshi market data with a local LM Studio model.
"""

import time
from typing import Any, Dict

from kalshi import KalshiClient
from lm_studio import LMLocalModel


class NemoTradingAgent:
    def __init__(self, api_key: str, model_path: str) -> None:
        self.kalshi_client = KalshiClient(api_key)
        self.lm_model = LMLocalModel(model_path)
        self.max_risk_per_position = 0.05
        self.paper_trading_mode = True

    def get_account_info(self) -> Dict[str, Any]:
        return self.kalshi_client.get_account()

    def place_trade(self, symbol: str, side: str, quantity: float) -> Dict[str, Any] | None:
        trade_data = {
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "risk_per_position": self.max_risk_per_position,
        }
        if self.paper_trading_mode:
            print(f"Paper trading mode: Placing trade - {trade_data}")
            return None
        return self.kalshi_client.place_trade(trade_data)

    def get_market_data(self, symbol: str) -> Dict[str, Any]:
        return self.kalshi_client.get_market(symbol)

    def decide_on_trade(self, market_data: Dict[str, Any]) -> str:
        # Decision-making logic using LM Studio
        trade_decision = self.lm_model.predict(market_data)
        return str(trade_decision).lower()

    def calculate_quantity(self, last_price: float) -> float:
        # Simple risk-based sizing; adjust as needed.
        account = self.get_account_info()
        balance = float(account.get("balance", 0))
        if last_price <= 0 or balance <= 0:
            return 0.0
        position_budget = balance * self.max_risk_per_position
        return max(position_budget / last_price, 0.0)


def main() -> None:

    import os
    api_key = os.environ.get("KALSHI_API_KEY")
    model_path = os.environ.get("LMSTUDIO_MODEL_PATH")
    if not api_key:
        raise ValueError("KALSHI_API_KEY environment variable not set.")
    if not model_path:
        raise ValueError("LMSTUDIO_MODEL_PATH environment variable not set.")

    agent = NemoTradingAgent(api_key, model_path)

    while True:
        try:
            symbol = "BTCUSD"  # Example symbol
            market_data = agent.get_market_data(symbol)

            trade_decision = agent.decide_on_trade(market_data)

            if trade_decision == "buy":
                quantity = agent.calculate_quantity(market_data.get("last_price", 0))
                trade_response = agent.place_trade(symbol, "BUY", quantity)
                print(f"Trade placed: {trade_response}")
            elif trade_decision == "sell":
                quantity = agent.calculate_quantity(market_data.get("last_price", 0))
                trade_response = agent.place_trade(symbol, "SELL", quantity)
                print(f"Trade placed: {trade_response}")

            time.sleep(60)

        except Exception as exc:
            print(f"An error occurred: {exc}")


if __name__ == "__main__":
    main()
