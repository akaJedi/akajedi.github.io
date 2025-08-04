+++
title =  "Footer"
type = "footer"
draft = false
+++

<div id="message" style="margin-top:1em;"></div>

{{< contact-section
    title="Reach out" 
    contact_form_name="Your name"
    contact_form_email="Your e-mail"
    contact_form_message="Your text"
    contact_form_phone="Your phone"
    contact_button="Send message"
    form_action="https://green-rice-1ea7.denis-f21.workers.dev"
    form_method="POST"
    contact_form_rows="2"
>}}



<script>
document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  const messageBox = document.getElementById("message");

  form.addEventListener("submit", async function (e) {
    e.preventDefault(); // 🔒 prevent redirect

    const name = form.querySelector("[name='full_name']").value.trim();
    const email = form.querySelector("[name='email']").value.trim();
    const phone = form.querySelector("[name='phone']").value.trim();
    const message = form.querySelector("[name='message']").value.trim();
    const secret = form.querySelector("[name='secret_field']")?.value || "";

    // Simple client-side validation
    if (!name || !email || !message) {
      messageBox.textContent = "❗Please fill out your name, email, and message.";
      messageBox.style.color = "red";
      return;
    }

    const data = { name, email, phone, message, secret_field: secret };

    try {
      const response = await fetch(form.action, {
        method: form.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        messageBox.textContent = "✅ Your message has been sent successfully!";
        messageBox.style.color = "green";
        form.reset(); // optional: clear form
      } else {
        messageBox.textContent = "❌ Something went wrong. Please try again later.";
        messageBox.style.color = "red";
      }
    } catch (error) {
      messageBox.textContent = "⚠️ Failed to send. Network error.";
      messageBox.style.color = "red";
    }
  });
});
</script>
