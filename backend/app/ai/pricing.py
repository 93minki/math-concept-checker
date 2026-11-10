from decimal import Decimal

# USD per 1M tokens; checked 2026-11-10:
# https://ai.google.dev/gemini-api/docs/pricing
# https://developers.openai.com/api/docs/models/gpt-6.1-terra
PRICES: dict[str, tuple[Decimal, Decimal]] = {
    "gemini-3.8-flash": (Decimal("1.50"), Decimal("7.50")),
    "gpt-6.1-terra": (Decimal("1"), Decimal("5")),
}
GEMINI_DISCOUNT = (Decimal("0.75"), Decimal("3.75"))  # Through 2026-12-31.


def cost_usd(
    model: str, input_tokens: int, output_tokens: int, standard: bool = True
) -> Decimal:
    if input_tokens < 0 or output_tokens < 0:
        raise ValueError("Token counts must be non-negative")
    prices = PRICES[model]
    if model == "gemini-3.8-flash" and not standard:
        prices = GEMINI_DISCOUNT
    return (prices[0] * input_tokens + prices[1] * output_tokens) / 1_000_000
