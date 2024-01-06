export let sleep_time = 0;
export function add_sleep_minutes(c: number) {
  sleep_time += c * 60_000;
}

export function set_sleep(c: number) {
  sleep_time = c;
}