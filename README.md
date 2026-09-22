# Codex Weekly Status

**Português** · [English](README.en.md)

Veja seus limites de uso do Codex, logo abaixo de onde você digita.

![Codex mostrando 49% do limite semanal disponível](assets/terminal.png)

`weekly 49% left` significa **49% do limite semanal restante**. O valor atualiza sozinho, sem consumir seu limite para consultar o saldo.

Se sua conta também tiver limite de **5 horas**, ele aparece como `5h`. Quem tem apenas o semanal continua vendo só `weekly`.

## Instalar

Funciona no **Windows, macOS e Linux**. Você precisa ter:

- Codex no terminal, conectado à sua conta do ChatGPT com limites de uso.
- Node.js 20+ e Git instalados.

Copie estes comandos no terminal:

```sh
git clone https://github.com/08Ryanxp/codex-weekly-status.git
cd codex-weekly-status
node setup.mjs
```

Feche e abra o Codex para ver o indicador. Para continuar uma conversa existente, use `codex resume`.

Suas outras configurações são preservadas.

**Já instalou antes?** Na pasta do projeto, execute `git pull` e depois `node setup.mjs` para atualizar.

## Remover

Na pasta `codex-weekly-status`, execute:

```sh
node setup.mjs --remove
```

Reabra o Codex. Isso remove apenas os indicadores de limite.

**Não apareceu?** Confira se os limites aparecem em `/status` e tente aumentar a largura do terminal.

Projeto da comunidade · [Licença MIT](LICENSE)
