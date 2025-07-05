
"use client"

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { FormGeneratorOutput } from '@/ai/flows/form-generator-flow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type FormField = FormGeneratorOutput['fields'][0];

const FormFieldRenderer: React.FC<{
    field: FormField;
    value: any;
    onChange: (id: string, value: any) => void;
}> = ({ field, value, onChange }) => {
    switch (field.type) {
        case 'title':
            return <h3 className="font-semibold text-lg pt-4 text-primary">{field.label}</h3>;
        case 'separator':
            return <Separator className="my-4" />;
        case 'text':
            return (
                <div className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input id={field.id} type="text" placeholder={field.placeholder} value={value || ''} onChange={(e) => onChange(field.id, e.target.value)} />
                </div>
            );
        case 'date':
             return (
                <div className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input id={field.id} type="date" placeholder={field.placeholder} value={value || ''} onChange={(e) => onChange(field.id, e.target.value)} />
                </div>
            );
        case 'textarea':
            return (
                <div className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Textarea id={field.id} placeholder={field.placeholder} rows={3} value={value || ''} onChange={(e) => onChange(field.id, e.target.value)} />
                </div>
            );
        case 'select':
            return (
                <div className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Select onValueChange={(val) => onChange(field.id, val)} value={value}>
                        <SelectTrigger id={field.id}><SelectValue placeholder={field.placeholder || "Sélectionner..."} /></SelectTrigger>
                        <SelectContent>
                            {field.options?.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            );
        case 'checkbox':
            return (
                <div className="flex items-center space-x-2">
                    <Checkbox id={field.id} checked={!!value} onCheckedChange={(checked) => onChange(field.id, checked)} />
                    <Label htmlFor={field.id} className="font-normal">{field.label}</Label>
                </div>
            );
        case 'file':
             return (
                <div className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input id={field.id} type="file" />
                    <p className="text-xs text-muted-foreground">Le téléversement de fichier n'est pas encore actif pour ce formulaire.</p>
                </div>
            );
        default:
            return null;
    }
};

export default function FillTemplatePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { toast } = useToast();
    const { user } = useAuth();

    const [template, setTemplate] = useState<FormGeneratorOutput | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!id) return;

        const fetchTemplate = async () => {
            setLoading(true);
            const docRef = doc(db, 'formTemplates', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const templateData = docSnap.data() as FormGeneratorOutput
                setTemplate(templateData);
                // Initialize form data
                const initialData: Record<string, any> = {};
                templateData.fields.forEach((field: FormField) => {
                    if (field.type !== 'title' && field.type !== 'separator') {
                         initialData[field.id] = '';
                    }
                    if (field.type === 'checkbox') {
                         initialData[field.id] = false;
                    }
                });
                setFormData(initialData);
            } else {
                console.log("No such document!");
            }
            setLoading(false);
        };

        fetchTemplate();
    }, [id]);

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !template) {
             toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible de soumettre le formulaire. Utilisateur ou modèle manquant.",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'formSubmissions'), {
                templateId: id,
                templateTitle: template.title,
                submittedBy: user.uid,
                userEmail: user.email,
                submittedAt: serverTimestamp(),
                formData: formData,
            });

            toast({
                title: "Formulaire Soumis",
                description: "Vos réponses ont été enregistrées avec succès.",
            });
            router.push('/dashboard');
        } catch (error) {
            console.error("Error submitting form data:", error);
            toast({
                variant: "destructive",
                title: "Erreur de Soumission",
                description: "Une erreur est survenue lors de l'enregistrement de vos réponses.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-7 w-96" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-4 w-3/4 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-32" />
                    </CardFooter>
                </Card>
            </div>
        )
    }

    if (!template) {
        return (
            <div className="text-center">
                <p>Le modèle de formulaire n'a pas été trouvé.</p>
                <Button asChild className="mt-4">
                    <Link href="/dashboard/templates">Retour à la bibliothèque</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                 <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                 </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Remplir le Formulaire</h1>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>{template.title}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {template.fields.map((field) => (
                            <FormFieldRenderer 
                                key={field.id} 
                                field={field} 
                                value={formData[field.id]}
                                onChange={handleFieldChange} 
                            />
                        ))}
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="mr-2 h-4 w-4" />
                            )}
                            Soumettre le formulaire
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
