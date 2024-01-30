import { Group, Center, Text } from '@mantine/core';
import { Spotlight } from '@mantine/spotlight';
import { IconFileDescription, IconHome, IconSearch, IconSettings } from '@tabler/icons-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';
import { usePageSearchQuery } from '@/features/search/queries/search-query';


export function SearchSpotlight() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(query, 300);
  const { data: searchResults, isLoading, error } = usePageSearchQuery(debouncedSearchQuery)

  const items = (searchResults && searchResults.length > 0 ? searchResults : [])
    .map((item) => (
        <Spotlight.Action key={item.title} onClick={() => navigate(`/p/${item.id}`)}>
          <Group wrap="nowrap" w="100%">
            <Center>
              {item?.icon ? (
                  <span style={{ fontSize: "20px" }}>{ item.icon }</span>
              ) : (
                <IconFileDescription size={20} />
              )}
            </Center>

            <div style={{ flex: 1 }}>
              <Text>{item.title}</Text>

              {item?.highlight && (
                <Text opacity={0.6} size="xs" dangerouslySetInnerHTML={{ __html: item.highlight }}/>
              )}
            </div>

          </Group>
        </Spotlight.Action>
      ));

  return (
    <>
      <Spotlight.Root query={query}
                      onQueryChange={setQuery}
                      scrollable
                      overlayProps={{
                        backgroundOpacity: 0.55,
                      }}>
        <Spotlight.Search placeholder="Search..."
                          leftSection={
                            <IconSearch size={20} stroke={1.5} />
                          } />
        <Spotlight.ActionsList>
          {query.length === 0 && items.length === 0 && <Spotlight.Empty>Start typing to search...</Spotlight.Empty>}

          {query.length > 0 && items.length === 0 && <Spotlight.Empty>No results found...</Spotlight.Empty>}

          {items.length > 0 && items}
        </Spotlight.ActionsList>


      </Spotlight.Root>

    </>
  );
}
