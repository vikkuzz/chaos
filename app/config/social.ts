/**
 * Ссылки на соцсети и каналы игры.
 * Задаются через переменные окружения.
 */
export const socialLinks = [
  {
    id: "vk",
    label: "ВКонтакте",
    url: process.env.NEXT_PUBLIC_SOCIAL_VK ?? "",
    icon: "vk",
  },
  {
    id: "telegram",
    label: "Telegram",
    url: process.env.NEXT_PUBLIC_SOCIAL_TELEGRAM ?? "",
    icon: "telegram",
  },
  {
    id: "max",
    label: "Макс",
    url: process.env.NEXT_PUBLIC_SOCIAL_MAX ?? "",
    icon: "max",
  },
].filter((item) => Boolean(item.url)) as Array<{
  id: string;
  label: string;
  url: string;
  icon: string;
}>;
