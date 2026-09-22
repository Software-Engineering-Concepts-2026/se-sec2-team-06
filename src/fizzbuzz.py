"""FizzBuzz kata used to demonstrate a test-first workflow."""


def _is_multiple(number: int, divisor: int) -> bool:
    return number % divisor == 0


def fizzbuzz(number: int) -> str:
    """Return the standard FizzBuzz label for one integer."""

    if _is_multiple(number, 15):
        return "FizzBuzz"
    if _is_multiple(number, 3):
        return "Fizz"
    if _is_multiple(number, 5):
        return "Buzz"
    return str(number)
