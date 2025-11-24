+++
title = "What is a transaction?"
date = 2024-10-10T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "transaction"
+++

**What is a transaction?**
*Asked with 40% probability*

<!--more-->


**Transaction in the context of databases** — is a sequence of data operations that are treated as a single unit. The main goal is to ensure reliable execution of a group of operations so that the database remains in a consistent state even in case of errors or failures. Subject to the ACID principle, which ensures:

**Atomicity**: Either executes completely or doesn't execute at all. If any part of the transaction cannot be completed, then all its actions are rolled back (cancelled), and the system returns to the state it was in before the transaction began.
**Consistency**: Moves the database from one consistent state to another. This means all data integrity rules are followed.
**Isolation**: Does not see intermediate states of other transactions. This prevents possible problems such as "dirty reads" or "non-repeatable reads".
**Durability**: After its completion (commit), its results are saved in the database regardless of subsequent system failures.

They are used to perform various tasks such as transferring funds between bank accounts, updating inventory in merchandise management systems, changes in user management systems, and many other operations requiring data integrity guarantees.

**Example:**

```php
BEGIN TRANSACTION;

UPDATE BankAccounts SET Balance = Balance - 100 WHERE AccountNumber = '123456';
UPDATE BankAccounts SET Balance = Balance + 100 WHERE AccountNumber = '654321';

COMMIT;
```

In this example, a transfer of funds between two bank accounts is made within one transaction. If updating the balance on either account cannot be performed for any reason (for example, due to a system failure), the transaction will be cancelled, and the database will return to its original state, thereby guaranteeing data integrity.

**Transaction** — is a mechanism that allows grouping multiple database operations into one unit to provide ACID guarantees, which is critically important for maintaining data integrity and reliability.
