+++
title = "What do you know about SELECT and joins?"
date = 2024-01-25T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "select-and-joins"
+++

**What do you know about SELECT and joins?**
*Asked with 27% probability*

<!--more-->


For working with databases and performing SELECT and join operations, you can use various extensions such as PDO (PHP Data Objects) or mysqli. Below I'll provide examples using PDO, as this extension provides a more flexible and secure interface for working with databases, including prepared statements that help avoid SQL injections.

Suppose we have a `users` table, and we want to select the names and ages of users older than 18. Here's how this can be done using PDO:

```php
setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $query = "SELECT name, age FROM users WHERE age >= 18";
    $stmt = $pdo->query($query);

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "Name: " . $row['name'] . ", Age: " . $row['age'] . "
";
    }
} catch (PDOException $e) {
    die("Connection error: " . $e->getMessage());
}
?>
```

Now let's consider an example where we need to get user names and their order names by joining the `users` and `orders` tables. We'll use INNER JOIN for this:

```php
setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $query = "
    SELECT users.name, orders.order_name
    FROM users
    INNER JOIN orders ON users.id = orders.user_id
    ";
    $stmt = $pdo->query($query);

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "User: " . $row['name'] . ", Order: " . $row['order_name'] . "
";
    }
} catch (PDOException $e) {
    die("Connection error: " . $e->getMessage());
}
?>
```

**General tips**

**1. Security**: Use prepared statements to protect against SQL injections, especially when queries use user-entered data.

2. **Debugging**: Set PDO error mode to `PDO::ERRMODE_EXCEPTION` to receive exceptions for database errors, which will facilitate debugging.

**3. Resource management**: Always close database connections and free resources when you no longer need them, for example, by closing PDOStatement objects after using them.

These examples demonstrate how you can effectively use PHP and PDO to work with databases, performing SELECT and join operations to retrieve and combine data.
