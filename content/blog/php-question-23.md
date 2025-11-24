+++
title = "What are interfaces?"
date = 2024-11-23T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "interfaces"
+++

**What are interfaces?**
*Asked with 27% probability*

<!--more-->


**Interfaces** — are structures that help define template methods that must be implemented in classes implementing them. Interfaces provide a way to formalize certain aspects of object behavior, ensuring that classes implement prescribed methods. This is useful for creating a unified API and for ensuring consistency between different parts of an application.

**Features:**

1. **Interface methods**: All methods in it must be public and cannot have implementation. The body of each method is defined only in classes that implement the interface.

2. **Interface inheritance**: Can inherit other interfaces, and a class can implement multiple interfaces, providing flexibility of multiple inheritance through interface programming.

**Use example**

Suppose you have an application with different ways of logging information (file, cloud, console). You can define a `LoggerInterface` interface that will have a `log()` method. Then, different classes such as `FileLogger`, `CloudLogger`, and `ConsoleLogger` can implement this interface, providing their unique implementation of the `log()` method.

```php
interface LoggerInterface {
    public function log($message);
}

class FileLogger implements LoggerInterface {
    public function log($message) {
        file_put_contents('log.txt', $message . PHP_EOL, FILE_APPEND);
    }
}

class CloudLogger implements LoggerInterface {
    public function log($message) {
        // sending message to cloud storage
    }
}

class ConsoleLogger implements LoggerInterface {
    public function log($message) {
        echo $message . PHP_EOL;
    }
}

// Use example
$logger = new FileLogger();
$logger->log("Hello, World!");
```

**Why are they needed?**

**Consistency**: Ensure standardization by requiring classes to implement certain methods.
**Flexibility**: Different classes can provide their own implementation of an interface, allowing programs to dynamically change behavior.
**Separation and encapsulation**: Allow creating code that can work with any object implementing the interface, without knowing the concrete implementation of that object.
