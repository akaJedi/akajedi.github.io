+++
title = "What is the difference between adapter and decorator?"
date = 2024-06-06T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "difference-between-adapter-and-decorator"
+++

**What is the difference between adapter and decorator?**
*Asked with 13% probability*

<!--more-->


**Adapter and decorator** — are structural design patterns used in object-oriented programming to solve various tasks in structuring classes and objects. Although both patterns wrap other objects, their goals and methods of application differ.

**Adapter**
**Goal**: Convert the interface of one class into the interface of another class that clients expect. Adapter allows classes with incompatible interfaces to work together.

**How it works**:
Adapter implements the interface that should be presented to the client and redirects client calls to an object with a different interface. Importantly, the adapter changes the interaction interface but does not add new functionality.

**Use case**:
You're developing an application that must use an existing class library whose interfaces are not compatible with the rest of your application. By creating an adapter for these classes, you can integrate the library without modifying its code or the application code.

**Decorator**
**Goal**: Dynamically add new functionality to an object. Unlike inheritance, decorators provide a flexible way to extend object functionality at runtime.

**How it works**:
Decorator wraps the original object, providing additional behavior. It has the same basic interface as the wrapped object, allowing decorators to be used interchangeably with the original objects.

**Use case**:
You're developing a notification system and want to add the ability to log or encrypt messages. By creating decorators for the base message sending class, you can easily add new functionality by wrapping the base sending object in one or more decorators.

Differences

**Purpose**: Adapter is used to ensure compatibility between different interfaces, allowing objects with incompatible interfaces to work together. Decorator adds new functionality to objects without changing their interfaces.
**Interface modification**: Adapter changes the object's interface for compatibility with another interface. Decorator does not change the interface but adds new behavior while preserving the object's original interface.
**Adding functionality**: Decorators are designed to add new functionality to objects. Adapters do not add new functionality; their main task is to ensure existing functionality works through a different interface.

The choice between adapter and decorator depends on the specific task: the need to overcome differences in interfaces or to add new behavior to an object.
