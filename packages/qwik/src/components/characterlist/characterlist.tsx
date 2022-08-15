import { component$, useMount$, useStore } from '@builder.io/qwik';

export interface Data {
  characters: string[]
}

export const Characterlist = component$(() => {
  const data: Data = useStore<Data>({
    characters: []
  })
  useMount$(async () => {
    let characters: any = await fetch("https://rickandmortyapi.com/api/character")
    .then(result => result.json())
    .then(json =>  json.results.map(({name}: any) => name))
    data.characters = characters
  })
  return <ul>
    {data.characters.map(character => <li>{character}</li>)}
  </ul>;
});