+++
title = "What is the essence of an abstract class?"
date = 2024-02-02T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "essence-of-abstract-class"
+++

**What is the essence of an abstract class?**
*Asked with 60% probability*

<!--more-->


**Abstract class in OOP in general** — is a special type of class that cannot be instantiated directly. This means you cannot create an object of an abstract class using the `new` operator directly. Its essence is to serve as a foundation for other classes from which objects will be created.

Used to define a common interface and behavior for a group of related classes. They allow developers to define methods that must be implemented in all inheriting classes, thereby ensuring uniformity and consistency. In addition, they can contain implementation of some methods that will be inherited by all derived classes, which reduces code duplication.

**Example**:

```php
abstract class Vehicle {
    protected $speed;

    public function setSpeed($speed) {
        $this->speed = $speed;
    }

    abstract public function move();
}

class Car extends Vehicle {
    public function move() {
        echo "Moving at speed: " . $this->speed . " km/h";
    }
}

// $vehicle = new Vehicle(); // Error: cannot be instantiated
$car = new Car();
$car->setSpeed(60);
$car->move();
```

In this example, the `Vehicle` class defines common behavior and properties for all vehicles, such as `setSpeed`, and requires inheriting classes to implement the `move` method. The abstract method `move` must be implemented in each concrete child class, which ensures that all vehicles will have the ability to move, but the way this ability is implemented may differ depending on the type of vehicle.

The essence of an abstract class, therefore, is to define a template (or common behavior) for a group of classes, while providing flexibility in implementing specific behavior in each of the derived classes.
