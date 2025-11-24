+++
title = "Why is the final keyword needed?"
date = 2024-08-20T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "final-keyword"
+++

**Why is the final keyword needed?**
*Asked with 27% probability*

<!--more-->


The **final** keyword is used to control class and method inheritance, limiting their further modification in child classes. This keyword can be applied to both classes and methods and serves as an important tool for controlling application architecture.

Use with classes

When it is applied to a class, this means the class cannot be inherited. This is useful when a class was designed with the understanding that it is final in its hierarchy and its functionality should not be extended. Using it for a class guarantees that its behavior will remain unchanged in all uses, which can be critically important for security or stability.

```php
final class BaseClass {
    public function sayHello() {
        echo "Hello, I am a final class!";
    }
}

// This will cause an error, as BaseClass cannot be inherited
class ChildClass extends BaseClass {
}
```

Use with methods
Applying `final` to a class method prevents its overriding in any child class. This is useful in cases where a method carries key logic that should not be changed to preserve the intended object behavior. Thus, it helps ensure that certain important aspects of class behavior will be preserved in all its descendants.

```php
class BaseClass {
    final public function sayHello() {
        echo "Hello, I cannot be overridden!";
    }
}

class ChildClass extends BaseClass {
    // This will cause an error, as the sayHello() method is declared as final and cannot be overridden
    public function sayHello() {
        echo "Hello from Child!";
    }
}
```

Why is it needed?

Using `final` helps:
**Ensure security and reliability**: By limiting overriding, you can avoid errors or changes in key functionality that could lead to incorrect behavior or vulnerabilities.
**Simplify maintenance and development**: Classes and methods protected by `final` are easier to test and maintain, as you have fewer behavior variants to consider.
**Encapsulation and architecture management**: Allows developers to control how a class or method should be used, preventing unintended changes in the future.
