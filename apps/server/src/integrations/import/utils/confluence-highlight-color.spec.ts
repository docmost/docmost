import { mapConfluenceHighlightColor } from './confluence-highlight-color';

describe('mapConfluenceHighlightColor', () => {
  it('maps named DC colours to the Docmost table palette', () => {
    expect(mapConfluenceHighlightColor('grey')).toEqual({
      color: '#eaecef',
      name: 'gray',
    });
    expect(mapConfluenceHighlightColor('red')).toEqual({
      color: '#ffbead',
      name: 'red',
    });
    expect(mapConfluenceHighlightColor('yellow')).toEqual({
      color: '#fef1b4',
      name: 'yellow',
    });
  });

  it('is case- and whitespace-insensitive', () => {
    expect(mapConfluenceHighlightColor(' Grey ')).toEqual({
      color: '#eaecef',
      name: 'gray',
    });
  });

  it('maps teal to the closest Docmost colour', () => {
    expect(mapConfluenceHighlightColor('teal')).toEqual({
      color: '#b4d5ff',
      name: 'blue',
    });
  });

  it('passes hex values through untouched', () => {
    expect(mapConfluenceHighlightColor('#f4f5f7')).toEqual({
      color: '#f4f5f7',
    });
    expect(mapConfluenceHighlightColor('#4c9aff')).toEqual({
      color: '#4c9aff',
    });
  });
});
