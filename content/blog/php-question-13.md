+++
title = "What is SOLID?"
date = 2024-01-13T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "solid"
+++

**What is SOLID?**
*Asked with 40% probability*

<!--more-->


**SOLID** — is an acronym representing five fundamental principles of OOP and design, proposed by Robert Martin. These principles are aimed at improving code flexibility, readability, and maintainability, as well as simplifying its testing and refactoring. Here they are:

1. **S: Single Responsibility Principle** - Each class should have only one reason to change. This principle emphasizes that a class should deal with only one task or have one area of responsibility.

2. **O: Open/Closed Principle** - Software entities should be open for extension but closed for modification. This means you can add new functionality without changing existing code.

3. **L: Liskov Substitution Principle** - Objects in a program can be replaced with their descendants without changing the program's properties. This assumes that subclass objects should act the same way as superclass objects from which they originated.

4. **I: Interface Segregation Principle** - Clients should not depend on interfaces they don't use. This principle says it's better to have many specialized interfaces than one universal one.

5. **D: Dependency Inversion Principle** - High-level modules should not depend on low-level modules. Both categories should depend on abstractions. Furthermore, abstractions should not depend on details; details should depend on abstractions. This promotes loosening the coupling of system components.

Applying SOLID principles allows creating more understandable, flexible, and maintainable code, which simplifies further development and support of software. These principles are the key to building quality and scalable systems.
