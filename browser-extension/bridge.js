(() => {
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (
      message?.type !== "subloom:extension:read" ||
      sender.url !== chrome.runtime.getURL("popup.html")
    )
      return;

    const requestId = crypto.randomUUID();
    const origin = window.location.origin;
    const receive = (event) => {
      if (
        event.source === window &&
        event.origin === origin &&
        event.data?.type === "subloom:extension:response" &&
        event.data.requestId === requestId
      )
        finish(event.data.payload);
    };
    const finish = (payload) => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      reply(payload);
    };
    const timeout = setTimeout(() => finish({ status: "unavailable" }), 1100);
    window.addEventListener("message", receive);
    window.postMessage(
      { type: "subloom:extension:request", requestId },
      origin,
    );
    return true;
  });
})();
