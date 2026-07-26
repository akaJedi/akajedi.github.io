---
title: "CIDR Calculator"
description: "Calculate a subnet's network address, broadcast address, mask, and usable host range — plus quick-reference tables for private, reserved, and special IP ranges."
searchDescription: "CIDR / subnet calculator with public vs. private IP range classification and quick-reference tables."
layout: "cidr-calculator"
toolScript: "js/tools/cidr-calculator.js"
searchExclude: true
---

<section class="tool-card" aria-labelledby="tool-calc-title">
  <h2 id="tool-calc-title">Calculator</h2>
  <form class="tool-form" data-cidr-form>
    <label for="cidr-input">IP address / prefix</label>
    <div class="tool-form__row">
      <input id="cidr-input" name="cidr" type="text" value="192.168.1.0/24" autocomplete="off" spellcheck="false" placeholder="192.168.1.0/24">
      <button type="submit">Calculate</button>
    </div>
  </form>
  <p class="tool-error" data-cidr-error hidden></p>
  <dl class="tool-grid" data-cidr-result>
    <div><dt>Network address</dt><dd data-field="network"></dd></div>
    <div><dt>Broadcast address</dt><dd data-field="broadcast"></dd></div>
    <div><dt>Subnet mask</dt><dd data-field="mask"></dd></div>
    <div><dt>Wildcard mask</dt><dd data-field="wildcard"></dd></div>
    <div><dt>Usable host range</dt><dd data-field="range"></dd></div>
    <div><dt>Usable hosts</dt><dd data-field="hosts"></dd></div>
    <div><dt>Total addresses</dt><dd data-field="total"></dd></div>
    <div><dt>Classification</dt><dd data-field="classification"></dd></div>
  </dl>
</section>

<section class="tool-card" aria-labelledby="tool-prefix-title">
  <h2 id="tool-prefix-title">Common prefix lengths</h2>
  <div class="tool-table-wrap">
    <table class="tool-table">
      <thead><tr><th>Prefix</th><th>Subnet mask</th><th>Total addresses</th><th>Usable hosts</th></tr></thead>
      <tbody>
        <tr><td>/30</td><td>255.255.255.252</td><td>4</td><td>2</td></tr>
        <tr><td>/29</td><td>255.255.255.248</td><td>8</td><td>6</td></tr>
        <tr><td>/28</td><td>255.255.255.240</td><td>16</td><td>14</td></tr>
        <tr><td>/27</td><td>255.255.255.224</td><td>32</td><td>30</td></tr>
        <tr><td>/26</td><td>255.255.255.192</td><td>64</td><td>62</td></tr>
        <tr><td>/25</td><td>255.255.255.128</td><td>128</td><td>126</td></tr>
        <tr><td>/24</td><td>255.255.255.0</td><td>256</td><td>254</td></tr>
        <tr><td>/23</td><td>255.255.254.0</td><td>512</td><td>510</td></tr>
        <tr><td>/22</td><td>255.255.252.0</td><td>1,024</td><td>1,022</td></tr>
        <tr><td>/21</td><td>255.255.248.0</td><td>2,048</td><td>2,046</td></tr>
        <tr><td>/20</td><td>255.255.240.0</td><td>4,096</td><td>4,094</td></tr>
        <tr><td>/16</td><td>255.255.0.0</td><td>65,536</td><td>65,534</td></tr>
        <tr><td>/8</td><td>255.0.0.0</td><td>16,777,216</td><td>16,777,214</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section class="tool-card" aria-labelledby="tool-v4-ranges-title">
  <h2 id="tool-v4-ranges-title">Private &amp; reserved IPv4 ranges</h2>
  <div class="tool-table-wrap">
    <table class="tool-table">
      <thead><tr><th>Range</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td>10.0.0.0/8</td><td>Private — RFC 1918</td></tr>
        <tr><td>172.16.0.0/12</td><td>Private — RFC 1918</td></tr>
        <tr><td>192.168.0.0/16</td><td>Private — RFC 1918</td></tr>
        <tr><td>100.64.0.0/10</td><td>Carrier-grade NAT — RFC 6598</td></tr>
        <tr><td>127.0.0.0/8</td><td>Loopback</td></tr>
        <tr><td>169.254.0.0/16</td><td>Link-local (APIPA)</td></tr>
        <tr><td>192.0.0.0/24</td><td>IETF protocol assignments</td></tr>
        <tr><td>192.0.2.0/24</td><td>Documentation (TEST-NET-1)</td></tr>
        <tr><td>198.51.100.0/24</td><td>Documentation (TEST-NET-2)</td></tr>
        <tr><td>203.0.113.0/24</td><td>Documentation (TEST-NET-3)</td></tr>
        <tr><td>198.18.0.0/15</td><td>Benchmark testing</td></tr>
        <tr><td>224.0.0.0/4</td><td>Multicast</td></tr>
        <tr><td>240.0.0.0/4</td><td>Reserved for future use</td></tr>
        <tr><td>255.255.255.255/32</td><td>Limited broadcast</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section class="tool-card" aria-labelledby="tool-v6-ranges-title">
  <h2 id="tool-v6-ranges-title">Special IPv6 ranges</h2>
  <div class="tool-table-wrap">
    <table class="tool-table">
      <thead><tr><th>Range</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td>::/128</td><td>Unspecified address</td></tr>
        <tr><td>::1/128</td><td>Loopback</td></tr>
        <tr><td>fc00::/7</td><td>Unique local — private, RFC 4193</td></tr>
        <tr><td>fe80::/10</td><td>Link-local</td></tr>
        <tr><td>::ffff:0:0/96</td><td>IPv4-mapped address</td></tr>
        <tr><td>64:ff9b::/96</td><td>NAT64</td></tr>
        <tr><td>2001:db8::/32</td><td>Documentation</td></tr>
        <tr><td>2002::/16</td><td>6to4 (deprecated)</td></tr>
        <tr><td>ff00::/8</td><td>Multicast</td></tr>
        <tr><td>2000::/3</td><td>Global unicast — public</td></tr>
      </tbody>
    </table>
  </div>
</section>
