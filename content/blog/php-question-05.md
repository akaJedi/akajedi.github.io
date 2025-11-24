+++
title = "Tell me about SOLID principles?"
date = 2024-05-05T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "solid-principles"
+++

**Tell me about SOLID principles?**
*Asked with 40% probability*

<!--more-->


**SOLID principles** — are a set of five fundamental principles of OOP and design, proposed by Robert Martin. These principles help developers create systems that are easily scalable, understandable, convenient to maintain and extend. Applying them helps reduce dependencies between program modules, simplifies testing and updating.

**S** - Single Responsibility Principle
It states that a class should have only one reason to change. In other words, a class should perform only one task or have one area of responsibility. This simplifies understanding the class, testing it, and maintaining it.

**O** - Open/Closed Principle
According to it, software entities (classes, modules, functions, etc.) should be open for extension but closed for modification. This means you can add new functionality without changing existing code, which reduces the likelihood of introducing errors into already tested and working code.

**L** - Liskov Substitution Principle
This principle is formulated as: objects in a program should be replaceable with instances of their subtypes without altering the correctness of the program's execution. Simply put, a derived class should complement, not replace, the behavior of the base class.

**I** - Interface Segregation Principle
The interface segregation principle states that clients should not be forced to implement interfaces they don't use. This means it's better to have many specialized interfaces than one universal one.

**D** - Dependency Inversion Principle
The dependency inversion principle is that high-level modules should not depend on low-level modules. Both types of modules should depend on abstractions. Furthermore, abstractions should not depend on details; details should depend on abstractions. This principle aims to reduce dependencies between code modules.

Applying SOLID principles makes the system more flexible, understandable, and maintainable. Each principle helps solve specific design and maintenance problems in software, thereby ensuring the creation of a quality and long-lasting product.
