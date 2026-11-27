// True when a touch starts somewhere a sideways swipe must NOT switch tabs: a field, a video, or a row that scrolls sideways (unit pills).
export function swipeBlocked(n0) {
  for (let n = n0; n && n !== document.body; n = n.parentElement) {
    if (/^(INPUT|TEXTAREA|SELECT|VIDEO|IFRAME)$/.test(n.tagName)) return true;
    if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
  }
  return false;
}
