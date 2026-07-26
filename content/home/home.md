+++
title =  "Home"
type = "home"
draft = false
translationKey = "homepage"
+++

<section class="summer-hero" aria-labelledby="summer-hero-title">
  <div class="summer-hero__copy">
    <p class="summer-kicker">Free tools for engineers</p>
    <h1 id="summer-hero-title">F12</h1>
    <p class="summer-hero__role">A small toolbox, always growing</p>
    <p class="summer-hero__lead">Small, honest tools for the everyday friction of infrastructure and ops work — checking an IP, working out a subnet, generating a password safely. No accounts, no upsells, no dark patterns.</p>
    <p class="summer-hero__context">Everything here runs client-side wherever that's possible, and says plainly what it does and doesn't send anywhere. If it saves one engineer five minutes at 2am, it's done its job.</p>
    <p class="summer-hero__note">Built and maintained by <a href="/author/">Denis Tolochko</a>, an IT Systems Operations Engineer — <a href="/contact/">say hello</a> or <a href="/tools/">browse the tools</a>.</p>
  </div>
  <div class="summer-signal">
    <div class="summer-signal__ring summer-signal__ring--one" data-signal-wheel role="button" tabindex="0" aria-label="Swipe down to accelerate the wheel"></div>
    <div class="summer-signal__panel" data-signal-carousel data-interval="10000" data-pause-label="Pause slideshow" data-resume-label="Resume slideshow">
      <div class="summer-signal__slides" aria-live="off">
        <div class="summer-signal__slide is-active" data-signal-slide aria-hidden="false">
          <span class="summer-signal__label">Operational focus</span>
          <strong>Reliable systems</strong>
          <span>infrastructure people can operate and trust</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Delivery model</span>
          <strong>Cloud + IaC</strong>
          <span>repeatable environments with fewer surprises</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Reliability practice</span>
          <strong>Observe + Recover</strong>
          <span>monitoring, backups, and incident readiness</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Automation principle</span>
          <strong>Remove toil</strong>
          <span>small tools that return time to the team</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Security posture</span>
          <strong>Least privilege</strong>
          <span>identity and access designed with intent</span>
        </div>
        <div class="summer-signal__slide" data-signal-slide aria-hidden="true">
          <span class="summer-signal__label">Collaboration mode</span>
          <strong>Clear handoffs</strong>
          <span>documentation and context that travel with the work</span>
        </div>
      </div>
      <div class="summer-signal__controls">
        <span class="summer-signal__lights" aria-hidden="true">
          <i class="is-active"></i><i></i><i></i><i></i><i></i><i></i>
        </span>
        <button type="button" class="summer-signal__toggle" data-signal-toggle aria-label="Pause slideshow" aria-pressed="false"></button>
      </div>
    </div>
    <div class="summer-signal__grid" data-signal-pads data-coffee-label="Coffee music" role="group" aria-label="Interactive color tiles">
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
      <span></span><span></span><span></span><span></span>
    </div>
  </div>
</section>

<section class="summer-band summer-band--intro">
  <div class="summer-band__eyebrow">Why F12 exists</div>
  <div class="summer-band__content">
    <h2>Small tools, built to actually get used.</h2>
    <p>Most engineering friction is small and repetitive: checking connectivity, working out a subnet, generating a password that's actually random. F12 is a growing set of tools for exactly that — fast, free, and built the way I'd want them built if I were the one reaching for them.</p>
  </div>
</section>

{{< tools-preview >}}

<section class="summer-proof">
  <div>
    <p class="summer-kicker">Who's behind this</p>
    <h2><a href="/author/">Denis Tolochko</a>, IT Systems Operations Engineer.</h2>
  </div>
  <div class="summer-proof__links">
    <a href="/author/">Author</a>
    <a href="/experience/">Experience</a>
    <a href="/resume/">Resume</a>
  </div>
</section>

<section class="summer-notes">
  <div class="summer-notes__visual" aria-hidden="true">
    <span></span><span></span><span></span><span></span>
  </div>
  <div>
    <p class="summer-kicker">Notes and research</p>
    <h2>Writing about infrastructure, operations, and the work behind the work.</h2>
    <p>Short technical notes, longer career reflections, and practical documentation from systems work.</p>
    <a class="summer-read-more" href="/blog/">Read the blog</a>
  </div>
</section>

<section class="summer-social">
  {{< platform-links >}}
    {{< link icon="square-github" label="GitHub" url="https://github.com/akajedi" >}}
    {{< link icon="linkedin" label="LinkedIn" url="https://www.linkedin.com/in/denistolochko" >}}
    {{< link icon="square-twitter" label="Twitter" url="https://twitter.com/denistolochko" >}}
    {{< link icon="email" label="Open website chat" url="/contact/" >}}
  {{< /platform-links >}}
</section>
