"""FizzBuzz kata used to demonstrate a test-first workflow."""


def fizzbuzz(number: int) -> str:
    """Return the standard FizzBuzz label for one integer."""

    if number % 15 == 0:
        return "FizzBuzz"
    if number % 3 == 0:
        return "Fizz"
    if number % 5 == 0:
        return "Buzz"
    return str(number)
