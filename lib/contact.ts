export const contactEmail='letsrockofficial22@gmail.com';

export function buildContactMailto({name,email,topic,message}:{name:string;email:string;topic:string;message:string}){
  const subject=encodeURIComponent(`SpendWise ${topic}`);
  const body=encodeURIComponent(`Name: ${name.trim()||'Not provided'}\nReply email: ${email.trim()||'Not provided'}\nTopic: ${topic}\n\n${message.trim()}`);
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}
