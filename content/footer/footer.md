+++
title =  "Footer"
type = "footer"
draft = false
+++

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
  const form = document.querySelector(".contact__form");
  const messageBox = document.getElementById("message");

  if (!form || !messageBox) {
    console.error("Form or message box not found");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nameInput = form.querySelector("[name='full_name']");
    const emailInput = form.querySelector("[name='email']");
    const phoneInput = form.querySelector("[name='phone']");
    const messageInput = form.querySelector("[name='message']");

    if (!nameInput || !emailInput || !messageInput) {
      console.error("Required form fields not found");
      messageBox.textContent = "❌ Form error. Please refresh the page.";
      messageBox.style.color = "red";
      return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !email || !message) {
      messageBox.textContent = "❗Please fill out your name, email, and message.";
      messageBox.style.color = "red";
      return;
    }

    const data = {
      full_name: name,
      email: email,
      phone: phone,
      message: message
    };

    messageBox.textContent = "Sending...";
    messageBox.style.color = "#478079";

    try {
      console.log("Sending to:", form.action);
      console.log("Data:", data);

      const response = await fetch(form.action, {
        method: form.method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(data),
      });

      console.log("Response status:", response.status);
      const result = await response.json();
      console.log("Result:", result);

      if (result.success || response.ok) {
        messageBox.textContent = "✅ Your message has been sent successfully!";
        messageBox.style.color = "green";
        form.reset();
      } else {
        messageBox.textContent = `❌ ${result.error || result.message || 'Something went wrong. Please try again.'}`;
        messageBox.style.color = "red";
      }
    } catch (error) {
      console.error("Form submission error:", error);
      messageBox.textContent = "⚠️ Failed to send. Network error.";
      messageBox.style.color = "red";
    }
  });
});
</script>