+++
title = "Getting Started With Go"
date = 2025-05-21T10:28:08-07:00
draft = false
featured = false
weight = 100  # Lower weight appears first in featured sections
description = ""
tags = []
topics = []
+++

![Example image](/img/blog/go.jpeg)

Go (or Golang) is a modern programming language created by Google, designed to be **simple, fast, and reliable**.  
If you want to try it out, you don’t need much — just a machine (Windows or Linux) and a bit of curiosity.  
<!--more-->
----

🛠 Installing Go On Windows

1. Download Go from the [official site](https://go.dev/dl/).
2. Run the installer and follow the defaults.
3. Open **PowerShell** or **Command Prompt** and check:

```go
go version

```
Create a file called hello.go:

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Go World!")
}

```

Run it with:

```go
go run hello.go

```
Or I can build a binary

```go
go build hello.go

.\hello.exe
Hello, Go World!

```
Let’s build a simple DIY tool: a command that greets you with your name.

```go
package main

import (
    "fmt"
    "os"
)

func main() {
    if len(os.Args) < 2 {
        fmt.Println("Usage: greet <name>")
        return
    }
    name := os.Args[1]
    fmt.Printf("Hello, %s! Welcome to Go.\n", name)
}
```

As result we can pass argument to our tool

```powershell
PS C:\Users\user\Desktop\GoLearn> go build .\tool.go
PS C:\Users\user\Desktop\GoLearn> .\tool.exe
Usage: greet <name>
PS C:\Users\user\Desktop\GoLearn> .\tool.exe Denis
Hello, Denis! Welcome to Go.
PS C:\Users\user\Desktop\GoLearn> 
```