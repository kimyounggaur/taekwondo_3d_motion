import js from '@eslint/js'
import tseslint from 'typescript-eslint'
export default tseslint.config({ ignores:['dist/**','dist-qa/**'] }, js.configs.recommended, ...tseslint.configs.recommended, {
  rules:{ 'no-undef':'off' }
})
