+++
title = "What happens to a request after entering it in the address bar?"
date = 2024-09-09T10:00:00-07:00
draft = false
tags = ["PHP", "learn", "refresh"]
slug = "what-happens-to-request"
+++

**What happens to a request after entering it in the address bar?**
*Asked with 13% probability*

<!--more-->


When you enter a request in the browser's address bar and press Enter, a series of actions occur that ultimately lead to the display of a web page or other resource. Here are the main stages of this process:

1. **URL Parsing**
The browser analyzes the entered URL (Uniform Resource Locator) to determine which resource to access. The URL contains information about the protocol (for example, HTTP or HTTPS), domain name or IP address of the server, and possibly the path to a specific resource on the server.

2. **IP Address Lookup**
If a domain name is specified in the URL, the browser must determine the corresponding server IP address. To do this, it first checks the local system's DNS cache and, if it doesn't find the needed information there, contacts the DNS server of your internet provider or other DNS servers on the network to resolve the name to an IP address.

3. **Establishing Connection**
After determining the server's IP address, the browser attempts to establish a connection with it using the TCP (Transmission Control Protocol) on port 80 for HTTP or port 443 for HTTPS. In the case of using HTTPS, an SSL/TLS handshake process also occurs to establish a secure connection.

4. **Sending HTTP Request**
Once the connection is established, the browser forms and sends an HTTP request to the server. The request contains the request method (for example, GET to retrieve data), the URL of the requested resource, and headers that may include additional information such as content types that the browser can correctly display.

5. **Server Request Processing**
The server receives the request, processes it, and forms a response. The response may contain the requested resource (for example, an HTML page), a status code (for example, 200 OK or 404 Not Found), and response headers indicating content type, response size, caching, and other parameters.

6. **Loading Resources**
The browser receives the response from the server, interprets the received content (for example, HTML), and begins loading additional resources such as CSS styles, JavaScript files, images, etc., that are necessary for complete page display. These resources may be loaded from the same server or from other servers.

7. **Page Display**
After loading and processing all resources, the browser displays the web page to the user. At this point, additional actions may begin, such as executing JavaScript code, which can change page content or even load new data from the server.

This process can vary depending on specific conditions such as caching settings, use of proxy servers, specifics of web applications, etc.
