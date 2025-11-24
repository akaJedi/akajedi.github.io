+++
title = "What are PSR and RFC in the PHP world?"
date = 2024-06-18T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "php-psr-and-rfc"
+++

**What are PSR and RFC in the PHP world?**
*Asked with 33% probability*

<!--more-->


**PSR (PHP Standard Recommendation) and RFC (Request for Comments)** play important roles in standardization and development of PHP.

PSR (PHP Standard Recommendation)

These are standards proposed by PHP Framework Interop Group (PHP-FIG), a group consisting of representatives from leading PHP projects. The goal of these standards is to improve compatibility between different PHP frameworks and libraries. Its standards cover various aspects of PHP programming, such as coding style, logging, class autoloading, and many others.

Example of the PSR-4 standard, which concerns class autoloading. According to PSR-4, each class must be in a separate file, and the class namespace must correspond to the file system directory structure. This simplifies class autoloading without the need to register each class manually.

```php
// Example of autoloading according to PSR-4
spl_autoload_register(function ($class) {
    include 'src/' . str_replace('\\', '/', $class) . '.php';
});
```

RFC (Request for Comments)

These are documents that propose innovations or changes in the PHP language. Any community member can propose an RFC, which will be reviewed and possibly accepted for implementation in future PHP versions. RFCs are discussed on the official PHP website and mailing lists, where developers can express their opinions and vote for or against proposals.

RFCs often include detailed descriptions of proposed features, code examples, discussion of possible problems, and other technical details. For example, the introduction of function argument typing in PHP was approved through the RFC process.

PSR and RFC are important elements of the PHP ecosystem. PSR helps developers follow common standards and ensures better compatibility between different projects. RFC allows the community to direct PHP development by proposing and discussing new features and changes.
