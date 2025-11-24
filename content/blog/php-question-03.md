+++
title = "What design patterns do you know?"
date = 2024-03-03T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "design-patterns"
+++

**What design patterns do you know?**
*Asked with 47% probability*

<!--more-->


**Design patterns** — are proven solutions to typical problems that arise in software development. They help make code more modular, flexible, and maintainable. They are divided into three main categories depending on their purpose:

Creational
Related to the process of creating objects, making the system more independent of how objects are created, composed, and represented.
**Abstract Factory:** provides an interface for creating families of related or dependent objects without specifying their concrete classes.
**Builder:** separates the construction of a complex object from its representation, so that the same construction process can create different representations.
**Factory Method:** defines an interface for creating an object, but lets subclasses decide which class to instantiate. Factory Method lets a class defer instantiation to subclasses.
**Prototype:** creates objects by copying an existing object, rather than creating a new one through a constructor.
**Singleton:** ensures that a class has only one instance and provides a global access point to it.

Structural
Describe how to combine objects and classes into larger structures while keeping the structures flexible and efficient.
**Adapter:** allows objects with incompatible interfaces to work together.
**Bridge:** separates abstraction and implementation so that they can vary independently.
**Composite:** allows grouping objects into tree structures to represent part-whole hierarchies.
**Decorator:** dynamically adds new responsibilities to objects without changing their interface.
**Facade:** provides a simplified interface to a complex system of classes, library, or framework.
**Flyweight:** used to reduce the cost of creating a large number of small similar objects.
**Proxy:** provides a substitute or placeholder for another object to control access to it.

Behavioral
Mainly describe not so much patterns of objects or classes, but patterns of interaction between them.
**Chain of Responsibility:** passes requests sequentially along a chain of handlers until one of them handles the request.
**Command:** turns requests into objects, allowing them to be passed as arguments when calling methods, queuing requests, logging them, and supporting undoable operations.
**Interpreter:** defines a grammar for a language and an interpreter for its grammar.
**Iterator:** provides a way to sequentially access all elements of an aggregate without exposing its internal representation.
**Mediator:** reduces complexity of interaction between objects by introducing a mediator between them.
**Memento:** allows saving and restoring the previous state of an object without revealing details of its implementation.
**Observer:** creates a subscription mechanism allowing some objects to monitor and react to events occurring in other objects.
**State:** allows an object to change its behavior depending on its state.
**Strategy:** defines a family of algorithms, encapsulates each of them, and makes them interchangeable.
**Template Method:** defines the skeleton of an algorithm in a method, deferring responsibility for some of its steps to subclasses.
**Visitor:** allows adding new operations to a program without changing the classes of objects on which these operations can be performed.

Each design pattern solves a specific problem and can be applicable in various situations depending on the project's characteristics and requirements.
