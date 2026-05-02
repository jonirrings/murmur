/** @jsxImportSource hono/jsx */
import { raw } from "hono/utils/html";

interface VisitorCounterScriptProps {
  pageKey: string;
  showReaderCount?: boolean;
}

export function visitorCounterScript({ pageKey, showReaderCount }: VisitorCounterScriptProps) {
  const script = `
(function() {
  var countEl = document.getElementById('vc-count');
  if (!countEl) return;
  var pageKey = ${JSON.stringify(pageKey)};
  var wsUrl = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/visitor-counter/ws?pageKey=' + encodeURIComponent(pageKey);
  var reconnectDelay = 1000;
  var maxDelay = 30000;
  var showReaderCount = ${showReaderCount ? "true" : "false"};

  function updateDisplay(count) {
    if (showReaderCount) {
      var label = count <= 0 ? '' : count === 1 ? '1 人正在阅读' : count + ' 人正在阅读';
      countEl.textContent = '';
      countEl.innerHTML = '\\uD83D\\uDC41 ' + label;
    } else {
      countEl.textContent = count;
    }
  }

  function connect() {
    var ws = new WebSocket(wsUrl);
    ws.onmessage = function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'count' && data.pageKey === pageKey) {
          updateDisplay(data.count);
        }
      } catch(err) {}
    };
    ws.onclose = function() {
      setTimeout(connect, reconnectDelay);
      if (reconnectDelay < maxDelay) reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
    };
    ws.onerror = function() { ws.close(); };
    window.addEventListener('beforeunload', function() { ws.close(); });
  }

  connect();
})();
`;
  return raw(`<script>${script}</script>`);
}
