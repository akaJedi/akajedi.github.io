+++
title = "How does the decorator pattern work?"
date = 2024-12-12T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "how-decorator-works"
+++

**How does the decorator pattern work?**
*Asked with 13% probability*

<!--more-->


**Decorator** — is a structural design pattern that allows dynamically adding new functions to objects by wrapping them in useful "wrappers". This pattern is often used to extend object functionality at runtime without changing the code of decorated classes.

How it works

Decorator provides a flexible alternative to inheritance for extending functionality. Instead of inheriting functionality from a base class, you create a set of classes with the same interface, each of which performs its role, adding or changing behavior.

Let's consider a simple example where we have a base `Coffee` class and several decorators for adding ingredients.

1. Define an interface:

```php

interface Coffee {
    public function getCost();
    public function getDescription();
}

2. Create a base `SimpleCoffee` class that implements this interface:
class SimpleCoffee implements Coffee {
    public function getCost() {
        return 50; // simple coffee cost
    }

    public function getDescription() {
        return 'Simple coffee';
    }
}
```

3. Define decorators:

```php

class MilkCoffee implements Coffee {
    protected $coffee;

    public function __construct(Coffee $coffee) {
        $this->coffee = $coffee;
    }

    public function getCost() {
        return $this->coffee->getCost() + 10; // add milk cost
    }

    public function getDescription() {
        return $this->coffee->getDescription() . ', milk';
    }
}

class VanillaCoffee implements Coffee {
    protected $coffee;

    public function __construct(Coffee $coffee) {
        $this->coffee = $coffee;
    }

    public function getCost() {
        return $this->coffee->getCost() + 15; // add vanilla cost
    }

    public function getDescription() {
        return $this->coffee->getDescription() . ', vanilla';
    }
}
```

4. Using decorators:

```php

$someCoffee = new SimpleCoffee();
echo $someCoffee->getDescription(); // Output: Simple coffee
echo $someCoffee->getCost(); // Output: 50

$someCoffee = new MilkCoffee($someCoffee);
echo $someCoffee->getDescription(); // Output: Simple coffee, milk
echo $someCoffee->getCost(); // Output: 60

$someCoffee = new VanillaCoffee($someCoffee);
echo $someCoffee->getDescription(); // Output: Simple coffee, milk, vanilla
echo $someCoffee->getCost(); // Output: 75
```

**Decorator** — is a pattern that allows extending object functionality without changing its structure by wrapping it in additional classes with the same interface. This allows adding functionality dynamically and flexibly.

**Simply put**, decorator is when you add new "decorations" or functions to an object by wrapping it in a new class that makes it even better or more useful without changing the base class.
