+++
title = "What data types are there in PHP?"
date = 2024-07-19T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "data-types-in-php"
+++

**What data types are there in PHP?**
*Asked with 33% probability*

<!--more-->


There are several basic data types, each serving specific purposes in programming. Data types can be divided into three main categories: simple (or scalar) types, compound types, and special types.

Simple (scalar) types
1. **Integer** — represents a whole number, can be either positive or negative. For example, `-123`, `0`, `456`.
2. **Float** — floating-point number. Used to represent fractional numbers, for example, `3.14`, `0.001`.
3. **String** — sequence of characters, used to work with text. For example, `"Hello, world!"`.
4. **Boolean** — has two values: `true` and `false`. Used for logical operations.

**Compound types**
1. **Array** — collection of data that can contain elements of any type. Arrays in PHP can be both indexed (with numeric keys) and associative (with string keys).

```php
      $array = [1, 2, 3]; // Indexed array
   $assocArray = ['name' => 'John', 'age' => 25]; // Associative array

```

2. **Object** — instance of a class that contains data (properties) and methods to work with this data. Objects are created based on classes.

```php
      class Car {
       public $color;
       function setColor($color) {
           $this->color = $color;
       }
   }
   $car = new Car();
   $car->setColor('red');

```

**Special types**
1. **Resource** — represents a reference to external resources such as files, database connections, etc.
2. **NULL** — type having one value `NULL`, used to denote a variable without a value.

There are four basic scalar data types (integers, floats, strings, boolean values), two compound types (arrays and objects), and special types (resource and NULL). Each of these data types is used for different tasks in programming, making PHP a powerful and flexible language for web application development.
