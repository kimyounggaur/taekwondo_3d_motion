import {Component,type ReactNode} from 'react'
export class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode;onError:()=>void},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){this.props.onError()}
  render(){return this.state.failed?this.props.fallback:this.props.children}
}
let support:boolean|undefined
export function supportsWebGL(){
  if(support!==undefined)return support
  try{
    const context=document.createElement('canvas').getContext('webgl2')
    support=Boolean(context)
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  }catch{support=false}
  return support
}
