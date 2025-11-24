+++
title = "What is an abstract class?"
date = 2024-04-04T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "abstract-class"
+++

**What is an abstract class?**
*Asked with 47% probability*

<!--more-->


**Abstract class** — is a class in OOP that cannot be instantiated directly, meaning you cannot create an object of an abstract class using the `new` operator. They are designed to serve as a base for other classes that must implement certain methods defined in it.

The main goal — is to provide a common class definition that can be used as a foundation for creating derived classes. Derived classes must implement all abstract methods of the abstract parent class, but they can also have additional methods and properties or override existing ones.

Often contain abstract methods — methods declared in an abstract class but having no implementation in it. The implementation of these methods must be provided in derived classes. This allows them to set the form and mandatory methods for all their descendants without defining the specific implementation of these methods.

Can also contain fully implemented methods, constructors, destructors, and properties that can be used or overridden in derived classes.

**Example:**

```php
abstract class Animal {
    public function eats() {
        echo "This animal eats";
    }

    abstract public function makesSound();
}

class Dog extends Animal {
    public function makesSound() {
        echo "Woof";
    }
}

// $animal = new Animal(); // Error: cannot instantiate abstract class
$dog = new Dog();
$dog->eats(); // Output: This animal eats
$dog->makesSound(); // Output: Woof
```

In this example, `Animal` is an abstract class with an abstract method `makesSound` and a regular method `eats`. The `Dog` class inherits the `Animal` class and must implement the abstract method `makesSound`. You cannot create an instance of the `Animal` class directly, but you can use it to create more specific animal classes such as `Dog`.

An abstract class defines a template for its descendants and can define some common functions that will be used or extended by these descendants.
