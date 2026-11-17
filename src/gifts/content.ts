/**
 * Everything personal lives here — edit freely.
 * (Đổi tên, chú thích ảnh theo ý bạn.)
 */

export const NAME = 'dilahn';

/** What the recipient is called in the text ("gửi dilahn"). */
export const ADDRESS = NAME;

export const PORTRAIT = {
  src: `${import.meta.env.BASE_URL}gift/dilahn.png`,
  /** {n} is replaced by the number of characters used */
  caption: `một khoảnh khắc của ${NAME} — vẽ lại bằng {n} ký tự`,
  hint: 'chạm vào tranh để xem ảnh thật',
};
