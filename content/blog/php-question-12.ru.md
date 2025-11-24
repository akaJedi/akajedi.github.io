+++
title = "Как устроен декоратор ?"
date = 2024-12-12T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "kak-ustroen-dekorator"
+++

**Как устроен декоратор ?**
*Спросят с вероятностью 13%*

<!--more-->


**Декоратор** — это структурный паттерн проектирования, который позволяет динамически добавлять новые функции объектам, оборачивая их в полезные «обёртки». Этот паттерн часто используется для расширения функциональности объектов на этапе выполнения без изменения кода декорируемых классов.

Как он работает

Декоратор предоставляет гибкую альтернативу наследованию для расширения функциональности. Вместо того чтобы наследовать функциональность от базового класса, вы создаёте набор классов с одинаковым интерфейсом, каждый из которых выполняет свою роль, добавляя или изменяя поведение.

Рассмотрим простой пример, где у нас есть базовый класс `Coffee` и несколько декораторов для добавления ингредиентов.

1. Определим интерфейс:

```php

interface Coffee {
    public function getCost();
    public function getDescription();
}

2. Создадим базовый класс `SimpleCoffee`, который реализует этот интерфейс:
class SimpleCoffee implements Coffee {
    public function getCost() {
        return 50; // стоимость простого кофе
    }

    public function getDescription() {
        return 'Simple coffee';
    }
}
```

3. Определим декораторы:

```php

class MilkCoffee implements Coffee {
    protected $coffee;

    public function __construct(Coffee $coffee) {
        $this->coffee = $coffee;
    }

    public function getCost() {
        return $this->coffee->getCost() + 10; // добавляем стоимость молока
    }

    public function getDescription() {
        return $this->coffee->getDescription() . ', milk';
    }
}

class VanillaCoffee implements Coffee {
    protected $coffee;

    public function __construct(Coffee $coffee) {
        $this->coffee = $coffee;
    }

    public function getCost() {
        return $this->coffee->getCost() + 15; // добавляем стоимость ванили
    }

    public function getDescription() {
        return $this->coffee->getDescription() . ', vanilla';
    }
}
```

4. Использование декораторов:

```php

$someCoffee = new SimpleCoffee();
echo $someCoffee->getDescription(); // Вывод: Simple coffee
echo $someCoffee->getCost(); // Вывод: 50

$someCoffee = new MilkCoffee($someCoffee);
echo $someCoffee->getDescription(); // Вывод: Simple coffee, milk
echo $someCoffee->getCost(); // Вывод: 60

$someCoffee = new VanillaCoffee($someCoffee);
echo $someCoffee->getDescription(); // Вывод: Simple coffee, milk, vanilla
echo $someCoffee->getCost(); // Вывод: 75
```

**Декоратор**  — это паттерн, позволяющий расширить функциональность объекта без изменения его структуры путём оборачивания его в дополнительные классы с тем же интерфейсом. Это позволяет добавлять функциональность динамически и гибко.

**Проще говоря**, декоратор - это когда вы добавляете новые "украшения" или функции к объекту, оборачивая его в новый класс, который делает его еще лучше или полезнее, не меняя основной класс.