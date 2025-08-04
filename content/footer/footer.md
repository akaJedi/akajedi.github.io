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
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form[action='https://green-rice-1ea7.denis-f21.workers.dev']");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.querySelector("[name='name']")?.value.trim();
    const email = form.querySelector("[name='email']")?.value.trim();
    const message = form.querySelector("[name='message']")?.value.trim();
    const phone = form.querySelector("[name='phone']")?.value.trim();
    const secret = form.querySelector("[name='secret_field']")?.value;

    if (!name || !email || !message) {
      alert("Please fill out your name, email, and message before submitting.");
      return;
    }

    const data = {
      name,
      email,
      message,
      phone,
      secret_field: secret
    };

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        alert("✅ Message sent successfully!");
        form.reset();
      } else {
        alert("❌ Error sending message. Please try again.");
      }
    } catch (err) {
      alert("⚠️ Network error. Please try again.");
    }
  });
});
</script>

