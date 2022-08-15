import { component$ } from '@builder.io/qwik';
import { Workerslot } from '../workerslot/workerslot';
import { Logo } from '../logo/logo';

export const App = component$(() => {
  return (
    <div class="my-app p-20">
      <Logo />

      <h1 class="text-3xl mb-2">Congratulations Qwik is working!</h1>

      <Workerslot />
      <hr class="mt-10" />
      <p class="text-center text-sm mt-2">
        Made with ❤️ by{' '}
        <a target="_blank" href="https://www.builder.io/">
          Builder.io
        </a>
      </p>
    </div>
  );
});