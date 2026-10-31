import react from '@vitejs/plugin-react';
export default {plugins:[react()],server:{host:'0.0.0.0',allowedHosts:true,proxy:{'/api':'http://localhost:3000'}}};
