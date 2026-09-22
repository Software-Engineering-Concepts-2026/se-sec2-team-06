"""FizzBuzz kata used to demonstrate a test-first workflow."""


def fizzbuzz(number: int) -> str:
    """Return the standard FizzBuzz label for one integer."""

    if number % 3 == 0:
        return "Fizz"
    raise NotImplementedError
