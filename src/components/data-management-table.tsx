
"use client"

import React, { useState, useEffect, useCallback } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, where, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { logActivity } from "@/lib/activityLogger"
import { useForm, Controller } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PlusCircle, Edit, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form"
import { MultiSelect, Option } from "./ui/multi-select"

interface DataItem extends Record<string, any> {
    id: string;
    nom: string;
    actif: boolean;
    zones?: string[];
    types?: string[];
}

interface RelationConfig {
    collectionName: string;
    label: string;
    formField: "zones" | "types";
}

interface DataManagementTableProps {
    collectionName: string;
    title: string;
    relationConfig?: RelationConfig;
}

const formSchema = z.object({
    nom: z.string().min(1, "Le nom est requis."),
    zones: z.array(z.string()).optional(),
    types: z.array(z.string()).optional(),
});
type FormValues = z.infer<typeof formSchema>;


export function DataManagementTable({ collectionName, title, relationConfig }: DataManagementTableProps) {
    const [items, setItems] = useState<DataItem[]>([]);
    const [relationOptions, setRelationOptions] = useState<Option[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<DataItem | null>(null);
    const { toast } = useToast();
    const { user } = useAuth();
    
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { nom: "", zones: [], types: [] },
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, collectionName), orderBy("nom"));
            const querySnapshot = await getDocs(q);
            const dataList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DataItem[];
            setItems(dataList);

            if (relationConfig) {
                const relQ = query(collection(db, relationConfig.collectionName), where("actif", "==", true), orderBy("nom"));
                const relSnapshot = await getDocs(relQ);
                setRelationOptions(relSnapshot.docs.map(doc => ({ value: doc.data().nom, label: doc.data().nom })));
            }
        } catch (error) {
            console.error(`Error fetching data for ${title}: `, error);
            toast({ variant: "destructive", title: "Erreur", description: `Impossible de charger les données pour ${title}.` });
        } finally {
            setLoading(false);
        }
    }, [collectionName, title, toast, relationConfig]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleActive = async (item: DataItem) => {
        const itemRef = doc(db, collectionName, item.id);
        try {
            await updateDoc(itemRef, { actif: !item.actif });
            await logActivity(user, `Changement statut de "${title}"`, { name: item.nom, newStatus: !item.actif });
            setItems(prevItems => prevItems.map(i => i.id === item.id ? { ...i, actif: !i.actif } : i));
            toast({ title: "Statut mis à jour", description: `"${item.nom}" est maintenant ${item.actif ? "inactif" : "actif"}.` });
        } catch (error) {
            console.error("Error updating status: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le statut." });
        }
    };

    const handleOpenSheet = (item: DataItem | null) => {
        setEditingItem(item);
        if (item) {
            form.reset({ nom: item.nom, zones: item.zones || [], types: item.types || [] });
        } else {
            form.reset({ nom: "", zones: [], types: [] });
        }
        setIsSheetOpen(true);
    };

    const handleFormSubmit = async (values: FormValues) => {
        const trimmedName = values.nom.trim();
        const isDuplicate = items.some(item => 
            item.nom.toLowerCase() === trimmedName.toLowerCase() && item.id !== editingItem?.id
        );
        if (isDuplicate) {
            form.setError("nom", { message: `L'élément "${trimmedName}" existe déjà.`})
            return;
        }

        const dataToSave: Record<string, any> = { nom: trimmedName };
        if (relationConfig) {
            dataToSave[relationConfig.formField] = values[relationConfig.formField] || [];
        }

        try {
            if (editingItem) {
                // Update
                const itemRef = doc(db, collectionName, editingItem.id);
                await updateDoc(itemRef, dataToSave);
                await logActivity(user, `Modification de "${title}"`, { oldName: editingItem.nom, newName: trimmedName });
                toast({ title: "Succès", description: `L'élément a été mis à jour.` });
            } else {
                // Add
                await addDoc(collection(db, collectionName), { ...dataToSave, actif: true });
                await logActivity(user, `Ajout à "${title}"`, { name: trimmedName });
                toast({ title: "Succès", description: `"${trimmedName}" a été ajouté.` });
            }
            setIsSheetOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving item: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'élément." });
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        const itemToDelete = items.find(i => i.id === itemId);
        if (!itemToDelete) return;

        const itemRef = doc(db, collectionName, itemId);
        try {
            await deleteDoc(itemRef);
            await logActivity(user, `Suppression de "${title}"`, { name: itemToDelete.nom });
            toast({ title: "Succès", description: "L'élément a été supprimé." });
            fetchData();
        } catch (error) {
            console.error("Error deleting document: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'élément." });
        }
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                 <Button onClick={() => handleOpenSheet(null)}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter</Button>
            </div>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead className="w-[100px]">Actif</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Skeleton className="h-8 w-8 inline-block" />
                                        <Skeleton className="h-8 w-8 inline-block" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : items.length > 0 ? (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.nom}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={item.actif}
                                            onCheckedChange={() => handleToggleActive(item)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenSheet(item)}>
                                            <Edit className="h-4 w-4" />
                                            <span className="sr-only">Modifier</span>
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Supprimer</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Cette action est irréversible. L'élément "{item.nom}" sera définitivement supprimé.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className={cn(buttonVariants({ variant: "destructive" }))}
                                                >
                                                   Supprimer
                                                </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    Aucun élément trouvé.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>{editingItem ? `Modifier "${editingItem.nom}"` : `Ajouter à "${title}"`}</SheetTitle>
                        <SheetDescription>
                            {relationConfig && `Liez cet élément à des ${relationConfig.label.toLowerCase()} pour affiner les options dans les formulaires.`}
                        </SheetDescription>
                    </SheetHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
                           <div className="flex-1 overflow-y-auto pr-6 -mr-6 py-4 space-y-8">
                             <FormField
                                control={form.control}
                                name="nom"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Nom de l'élément" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {relationConfig && (
                                <FormField
                                    control={form.control}
                                    name={relationConfig.formField}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{relationConfig.label} Associées</FormLabel>
                                             <MultiSelect
                                                options={relationOptions}
                                                selected={field.value || []}
                                                onChange={field.onChange}
                                                placeholder={`Sélectionner...`}
                                            />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            </div>
                            <SheetFooter className="pt-4">
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Enregistrer
                                </Button>
                            </SheetFooter>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>
        </div>
    );
}
