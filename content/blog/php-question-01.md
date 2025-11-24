+++
title = "What is the difference between abstract class and interface?"
date = 2024-01-01T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "difference-between-abstract-class-and-interface"
+++

**What is the difference between abstract class and interface?**
*Asked with 60% probability*

<!--more-->


**Abstract class and interface** - these are two mechanisms used to achieve abstraction in OOP, but each plays its own role and has its own characteristics.

**Abstract class** - cannot be instantiated (that is, you cannot create an object of this class directly). It is designed to serve as a base class for other classes. They can contain both abstract methods (without implementation) and methods with full implementation. Classes inheriting from it must implement all its abstract methods, but can also override implemented methods.

**Interface** represents a fully abstract class that contains only abstract methods (without implementation) and constants. Used to define a set of methods that a class must implement, without defining the logic for executing those methods. A single class can implement multiple interfaces, which provides greater flexibility and multiple inheritance.

**Key differences:**

1. **Inheritance vs. Implementation**: Classes inherit from an abstract class (`extends`), but implement an interface (`implements`).
2. **Methods and properties**: Abstract classes can contain both abstract and non-abstract methods and properties, while interfaces can only contain abstract methods and constants.
3. **Multiple inheritance**: A class cannot inherit from more than one abstract class, but can implement multiple interfaces.
4. **Constructors**: Abstract classes can have constructors, while interfaces cannot.

**Abstract class:**

```php
abstract class Animal {
    public function breathe() {
        echo "Breathes air";
    }

    abstract public function makeSound();
}

class Dog extends Animal {
    public function makeSound() {
        echo "Woof";
    }
}
```

**Interface:**

```php
interface Movable {
    public function move();
}

class Human implements Movable {
    public function move() {
        echo "Walks on two legs";
    }
}
```

An abstract class is used to define common behavior for descendants, while an interface defines a set of methods that a class must implement. Abstract classes can be used to define a foundation, and interfaces - to ensure flexible architecture through multiple inheritance.
