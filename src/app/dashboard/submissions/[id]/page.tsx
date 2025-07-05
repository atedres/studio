
"use client"

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, User, CalendarDays, Download } from 'lucide-react';
import { format } from "date-fns"
import { fr } from 'date-fns/locale'
import type { FormGeneratorOutput } from '@/ai/flows/form-generator-flow';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

type FormField = FormGeneratorOutput['fields'][0];

interface Submission {
    id: string;
    templateId: string;
    templateTitle: string;
    submittedBy: string;
    userEmail: string;
    submittedAt: Timestamp;
    formData: Record<string, any>;
}

const ReadOnlyFieldRenderer: React.FC<{ field: FormField; value: any }> = ({ field, value }) => {
    const emptyValue = <span className="text-muted-foreground italic">Non renseigné</span>;

    const renderValue = (val: any) => {
        if (val === undefined || val === null || val === '') {
            return emptyValue;
        }
        return val;
    }
    
    switch (field.type) {
        case 'title':
            return <h3 className="font-semibold text-lg pt-4 text-primary">{field.label}</h3>;
        case 'separator':
            return <Separator className="my-4" />;
        case 'text':
        case 'date':
        case 'textarea':
        case 'select':
            return (
                <div className="space-y-1.5">
                    <Label className="text-sm">{field.label}</Label>
                    <p className="text-sm font-medium p-2 border rounded-md bg-muted/50 min-h-[40px] whitespace-pre-wrap">{renderValue(value)}</p>
                </div>
            );
        case 'checkbox':
            return (
                <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium p-2">
                       {value ? <Badge variant="default">Oui</Badge> : <Badge variant="secondary">Non</Badge>}
                    </div>
                    <Label className="text-sm">{field.label}</Label>
                </div>
            );
        case 'file':
             return (
                <div className="space-y-1.5">
                   <Label className="text-sm">{field.label}</Label>
                   {typeof value === 'string' && value.startsWith('https://firebasestorage.googleapis.com') ? (
                       <Button asChild variant="outline" className="w-full max-w-xs justify-start">
                           <a href={value} target="_blank" rel="noopener noreferrer">
                               <Download className="mr-2 h-4 w-4" />
                               <span>Voir / Télécharger le fichier joint</span>
                           </a>
                       </Button>
                   ) : (
                       <p className="text-sm font-medium p-2 border rounded-md bg-muted/50 min-h-[40px]">
                           {emptyValue}
                       </p>
                   )}
               </div>
           );
        default:
            return null;
    }
};


export default function SubmissionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [submission, setSubmission] = useState<Submission | null>(null);
    const [template, setTemplate] = useState<FormGeneratorOutput | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const fetchSubmissionData = async () => {
            setLoading(true);
            try {
                const submissionRef = doc(db, 'formSubmissions', id);
                const submissionSnap = await getDoc(submissionRef);

                if (!submissionSnap.exists()) {
                    console.log("No such submission!");
                    setLoading(false);
                    return;
                }
                
                const submissionData = { id: submissionSnap.id, ...submissionSnap.data() } as Submission;
                setSubmission(submissionData);
                
                const templateRef = doc(db, 'formTemplates', submissionData.templateId);
                const templateSnap = await getDoc(templateRef);

                if (templateSnap.exists()) {
                    setTemplate(templateSnap.data() as FormGeneratorOutput);
                } else {
                    console.log("Associated template not found!");
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSubmissionData();
    }, [id]);

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
                    <CardContent className="space-y-6 mt-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!submission || !template) {
        return (
            <div className="text-center">
                <p>La soumission ou le modèle associé n'a pas été trouvé.</p>
                <Button asChild className="mt-4">
                    <Link href="/dashboard/submissions">Retour à la liste</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Détail de la Soumission</h1>
                        <p className="text-muted-foreground">ID: {submission.id}</p>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{template.title}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                    <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                           <User className="h-4 w-4" /> <span>{submission.userEmail}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" /> <span>{format(submission.submittedAt.toDate(), 'PPP p', { locale: fr })}</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                   {template.fields.map((field) => (
                       <ReadOnlyFieldRenderer 
                            key={field.id}
                            field={field}
                            value={submission.formData[field.id]}
                       />
                   ))}
                </CardContent>
            </Card>
        </div>
    );
}
