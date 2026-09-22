from src.fizzbuzz import fizzbuzz


def test_fizzbuzz_three_returns_fizz():
    assert fizzbuzz(3) == "Fizz"


def test_fizzbuzz_one_returns_number_as_text():
    assert fizzbuzz(1) == "1"


def test_fizzbuzz_five_returns_buzz():
    assert fizzbuzz(5) == "Buzz"


def test_fizzbuzz_fifteen_returns_fizzbuzz():
    assert fizzbuzz(15) == "FizzBuzz"


def test_fizzbuzz_seven_returns_number_as_text():
    assert fizzbuzz(7) == "7"
