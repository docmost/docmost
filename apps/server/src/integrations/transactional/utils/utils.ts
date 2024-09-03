export const formatDate = (date: Date) => {
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
};
