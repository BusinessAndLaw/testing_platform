'use client';
import { Toaster } from 'sonner';
export default function Notifications(){
 return <Toaster theme="light" position="top-right" duration={4000} visibleToasts={3} closeButton offset={24} mobileOffset={16} toastOptions={{classNames:{toast:'app-toast',title:'app-toast-title',description:'app-toast-description',closeButton:'app-toast-close'}}}/>;
}
