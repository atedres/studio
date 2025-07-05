"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore"
import { FileText, PlusCircle, ArrowRight } from "lucide-react"

interface FormTemplate {
    id: string;
    title: string;
    description: string;
    topic: string;
    createdAt: Timestamp;
}

export default function FormTemplatesPage() {
    const [templates, setTemplates] = useState<FormTemplate[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, "formTemplates"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                const templatesData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as FormTemplate[];
                setTemplates(templatesData);
            } catch (error) {
                console.error("Error fetching form templates: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTemplates();
    }, []);

    const renderSkeleton = () => (
        [...Array(3)].map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-4 w-1/2 mt-1" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-4 w-1/4" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-32" />
                </CardFooter>
            </Card>
        ))
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Bibliothèque de Modèles / مكتبة النماذج</h1>
                    <p className="text-muted-foreground">
                        Utilisez des modèles existants ou créez-en de nouveaux avec l'IA.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/form-builder">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Créer un modèle avec l'IA
                    </Link>
                </Button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {renderSkeleton()}
                </div>
            ) : templates.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(template => (
                        <Card key={template.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-start gap-2">
                                    <FileText className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                                    <span>{template.title}</span>
                                </CardTitle>
                                <CardDescription>{template.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground">
                                    <strong>Sujet d'origine :</strong> {template.topic}
                                </p>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" disabled>
                                    Utiliser ce modèle <ArrowRight className="ml-2 h-4 w-4"/>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border-dashed border-2 rounded-lg">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">Aucun modèle de formulaire trouvé</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Commencez par en créer un nouveau avec notre générateur IA.</p>
                </div>
            )}
        </div>
    )
}
